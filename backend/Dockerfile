FROM rust:bookworm AS build
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 10001 cinebox
COPY --from=build /app/target/release/cinebox-api /usr/local/bin/cinebox-api
USER cinebox
ENV PORT=8080
EXPOSE 8080
CMD ["cinebox-api"]
