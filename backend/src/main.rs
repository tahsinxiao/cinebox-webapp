use axum::{extract::{Query, State}, http::{HeaderMap,StatusCode}, routing::get, Json, Router};
use moviebox_tui::{service::MovieBoxService,providers::{ReleaseProvider,models::ProviderKind}};
use serde::Deserialize;
use serde_json::{Value,json};
use std::{env,sync::Arc,time::Duration};
use tokio::sync::Semaphore;
#[derive(Clone)]
struct App { service:MovieBoxService,key:String,enabled:bool,permits:Arc<Semaphore> }
#[derive(Deserialize)]
struct Params { #[serde(default)] q:String, #[serde(default)] id:String,page:Option<usize>,season:Option<usize>,episode:Option<usize> }
type ApiResult=Result<Json<Value>,(StatusCode,Json<Value>)>;
fn error(status:StatusCode,message:&str)->(StatusCode,Json<Value>){(status,Json(json!({"error":message})))}
fn authorize(app:&App,headers:&HeaderMap)->Result<(),(StatusCode,Json<Value>)>{
    if headers.get("x-api-key").and_then(|v|v.to_str().ok())!=Some(app.key.as_str()){return Err(error(StatusCode::UNAUTHORIZED,"Unauthorized"));}
    if !app.enabled{return Err(error(StatusCode::FORBIDDEN,"Provider disabled"));}Ok(())
}
fn valid_id(id:&str)->bool{!id.is_empty()&&id.len()<=200&&id.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'-'||c==b'_')}
fn safe_url(raw:&str)->bool{url::Url::parse(raw).is_ok_and(|u|u.scheme()=="https"&&u.username().is_empty()&&u.password().is_none())}
fn normalize(mut value:Value)->Value{
    if let Some(map)=value.as_object_mut(){
        let id=map.get("id").and_then(|v|v.get("value")).cloned().unwrap_or(Value::Null);map.insert("id".into(),id);
        if let Some(kind)=map.remove("media_type"){map.insert("type".into(),kind);}
        if let Some(poster)=map.remove("poster_url"){map.insert("poster".into(),poster.as_str().filter(|v|safe_url(v)).map(|v|json!(v)).unwrap_or(Value::Null));}
        if map.get("description").is_some_and(Value::is_null){map.remove("description");}
    }
    if let Some(seasons)=value.get_mut("seasons").and_then(Value::as_array_mut){for season in seasons{if let Some(episodes)=season.get_mut("episodes").and_then(Value::as_array_mut){for episode in episodes{if let Some(map)=episode.as_object_mut(){if map.get("title").is_some_and(Value::is_null){map.remove("title");}}}}}}
    value
}
fn needs_auth(value:&Value)->bool{match value{
    Value::Object(map)=>map.iter().any(|(key,v)|{
        let sensitive=["headers","http_headers","cookies","cookie","referer","user_agent"].contains(&key.as_str());
        (sensitive&&!v.is_null()&&v!=&json!({})&&v!=&json!([])&&v!=&json!(""))||needs_auth(v)
    }),Value::Array(values)=>values.iter().any(needs_auth),_=>false}}
async fn health()->Json<Value>{Json(json!({"status":"ok"}))}
async fn catalog(State(app):State<App>,headers:HeaderMap,Query(p):Query<Params>)->ApiResult{
    authorize(&app,&headers)?;
    if p.q.len()>120||!(1..=100).contains(&p.page.unwrap_or(1)){return Err(error(StatusCode::BAD_REQUEST,"Invalid search"));}
    let _permit=app.permits.try_acquire().map_err(|_|error(StatusCode::TOO_MANY_REQUESTS,"Server busy"))?;
    let items=if p.q.trim().is_empty(){
        let raw=tokio::time::timeout(Duration::from_secs(40),app.service.client.get_homepage("",p.page.unwrap_or(1))).await.map_err(|_|error(StatusCode::GATEWAY_TIMEOUT,"Provider timeout"))?.map_err(|_|error(StatusCode::BAD_GATEWAY,"Provider unavailable"))?;
        moviebox_tui::providers::moviebox::adapt::moviebox_homepage_json_to_catalog(&raw).0
    }else{tokio::time::timeout(Duration::from_secs(40),app.service.search_typed(ProviderKind::MovieBox,&p.q,p.page.unwrap_or(1))).await.map_err(|_|error(StatusCode::GATEWAY_TIMEOUT,"Provider timeout"))?.map_err(|_|error(StatusCode::BAD_GATEWAY,"Provider unavailable"))?};
    let items:Vec<Value>=items.into_iter().filter_map(|v|serde_json::to_value(v).ok()).map(normalize).collect();
    Ok(Json(json!({"mode":"live","items":items})))
}
async fn details(State(app):State<App>,headers:HeaderMap,Query(p):Query<Params>)->ApiResult{
    authorize(&app,&headers)?;if !valid_id(&p.id){return Err(error(StatusCode::BAD_REQUEST,"Invalid ID"));}
    let _permit=app.permits.try_acquire().map_err(|_|error(StatusCode::TOO_MANY_REQUESTS,"Server busy"))?;
    let item=tokio::time::timeout(Duration::from_secs(40),app.service.details_typed(ProviderKind::MovieBox,&p.id)).await.map_err(|_|error(StatusCode::GATEWAY_TIMEOUT,"Provider timeout"))?.map_err(|_|error(StatusCode::BAD_GATEWAY,"Details unavailable"))?;
    let value=serde_json::to_value(item).map_err(|_|error(StatusCode::INTERNAL_SERVER_ERROR,"Serialization failed"))?;
    Ok(Json(json!({"mode":"live","item":normalize(value)})))
}
async fn streams(State(app):State<App>,headers:HeaderMap,Query(p):Query<Params>)->ApiResult{
    authorize(&app,&headers)?;let s=p.season.unwrap_or(0);let e=p.episode.unwrap_or(0);
    if !valid_id(&p.id)||s>1000||e>10000{return Err(error(StatusCode::BAD_REQUEST,"Invalid episode"));}
    let _permit=app.permits.try_acquire().map_err(|_|error(StatusCode::TOO_MANY_REQUESTS,"Server busy"))?;
    let releases=tokio::time::timeout(Duration::from_secs(40),app.service.client.episode_streams(&p.id,s,e)).await.map_err(|_|error(StatusCode::GATEWAY_TIMEOUT,"Provider timeout"))?.map_err(|_|error(StatusCode::BAD_GATEWAY,"Stream resolution failed"))?;
    let mut streams=Vec::new();
    for release in releases{
        let Some(raw)=release.direct_url()else{continue;};if !safe_url(raw){continue;}
        let Ok(value)=serde_json::to_value(&release)else{continue;};if needs_auth(&value){continue;}
        let Ok(url)=url::Url::parse(raw)else{continue;};let path=url.path().to_ascii_lowercase();
        let format=if path.ends_with(".m3u8"){"hls"}else if path.ends_with(".mpd"){"dash"}else if path.ends_with(".mp4"){"mp4"}else{continue;};
        streams.push(json!({"url":raw,"label":format!("{}p · {}",release.resolution_u64(),format),"format":format,"subtitles":[]}));
    }
    Ok(Json(json!({"mode":"live","streams":streams,"warning":"Only direct HTTPS sources without custom headers or cookies are offered. CORS and codecs are not guaranteed. Authenticated sources and external subtitle extraction are not implemented."})))
}
#[tokio::main]
async fn main(){
    let key=env::var("API_KEY").expect("Set API_KEY");assert!(key.len()>=24&&!key.contains("replace-with"),"Use a random API_KEY of at least 24 characters");
    let app=App{service:MovieBoxService::new(),key,enabled:env::var("ENABLE_MOVIEBOX").as_deref()==Ok("true"),permits:Arc::new(Semaphore::new(16))};
    let router=Router::new().route("/health",get(health)).route("/catalog",get(catalog)).route("/details",get(details)).route("/streams",get(streams)).with_state(app);
    let port:u16=env::var("PORT").unwrap_or_else(|_|"8080".into()).parse().expect("Invalid PORT");
    let listener=tokio::net::TcpListener::bind(("0.0.0.0",port)).await.expect("Bind failed");
    axum::serve(listener,router).with_graceful_shutdown(async{let _=tokio::signal::ctrl_c().await;}).await.expect("Server failed");
}
#[cfg(test)]mod tests{use super::*;
    #[test]fn rejects_invalid_ids(){assert!(valid_id("123"));assert!(!valid_id("../secret"));assert!(!valid_id(""));}
    #[test]fn rejects_credentials(){assert!(!safe_url("https://u:p@example.com/a.mp4"));assert!(!safe_url("http://example.com/a.mp4"));}
    #[test]fn rejects_nested_auth(){assert!(needs_auth(&json!({"mirrors":[{"headers":{"Cookie":"secret"}}]})));assert!(!needs_auth(&json!({"headers":{}})));}
    #[test]fn normalizes_shapes(){let v=normalize(json!({"id":{"value":"123"},"media_type":"movie","description":null,"poster_url":null}));assert_eq!(v["id"],"123");assert_eq!(v["type"],"movie");assert!(v.get("description").is_none());}
}
