FROM node:22-bookworm-slim AS web
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
ARG EXPO_PUBLIC_API_URL=
ARG EXPO_PUBLIC_ISSUER_URL=
ARG EXPO_PUBLIC_CLIENT_ID=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_ISSUER_URL=$EXPO_PUBLIC_ISSUER_URL \
    EXPO_PUBLIC_CLIENT_ID=$EXPO_PUBLIC_CLIENT_ID \
    EXPO_NO_TELEMETRY=1 \
    CI=1
RUN npx expo export --platform web --output-dir dist

FROM golang:1.26.5-bookworm AS build
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -o /out/instacrane ./cmd/server

FROM cgr.dev/chainguard/static:latest
COPY --from=build /out/instacrane /instacrane
COPY --from=web /src/client/dist /web
ENV WEB_ROOT=/web
EXPOSE 8000
ENTRYPOINT ["/instacrane"]
