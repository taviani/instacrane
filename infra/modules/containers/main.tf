variable "project_id" {
  type = string
}

variable "registry_endpoint" {
  type = string
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "jwt_secret_key" {
  type      = string
  sensitive = true
}

variable "s3_bucket_name" {
  type = string
}

variable "app_domain" {
  type = string
}

resource "scaleway_container_namespace" "main" {
  name        = "instacrane"
  description = "Instacrane API containers"
  project_id  = var.project_id
}

resource "scaleway_container" "api" {
  name            = "instacrane-api"
  namespace_id    = scaleway_container_namespace.main.id
  registry_image  = "${var.registry_endpoint}/instacrane-api:latest"
  port            = 8000
  cpu_limit       = 1000
  memory_limit    = 512
  min_scale       = 0
  max_scale       = 5
  timeout         = 300
  max_concurrency = 50
  privacy         = "public"
  protocol        = "http1"
  deploy          = true

  environment_variables = {
    APP_ENV        = "production"
    APP_URL        = "https://${var.app_domain}"
    S3_ENDPOINT_URL = "https://s3.fr-par.scw.cloud"
    S3_BUCKET_NAME = var.s3_bucket_name
    S3_REGION      = "fr-par"
  }

  secret_environment_variables = {
    DATABASE_URL   = var.database_url
    JWT_SECRET_KEY = var.jwt_secret_key
  }
}

output "endpoint" {
  value = scaleway_container.api.domain_name
}
