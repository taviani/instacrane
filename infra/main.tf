terraform {
  required_version = ">= 1.9"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.40"
    }
  }

  backend "s3" {
    bucket                      = "instacrane-tfstate"
    key                         = "terraform.tfstate"
    region                      = "fr-par"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
  }
}

provider "scaleway" {
  zone   = "fr-par-1"
  region = "fr-par"
}

variable "scw_project_id" {
  type        = string
  description = "Scaleway project ID"
}

variable "database_password" {
  type        = string
  sensitive   = true
  description = "Password for the PostgreSQL database"
}

variable "jwt_secret_key" {
  type        = string
  sensitive   = true
  description = "JWT secret key"
}

variable "app_domain" {
  type        = string
  default     = "instacrane.fr"
  description = "Main application domain"
}

module "database" {
  source            = "./modules/database"
  project_id        = var.scw_project_id
  database_password = var.database_password
}

module "registry" {
  source     = "./modules/registry"
  project_id = var.scw_project_id
}

module "containers" {
  source            = "./modules/containers"
  project_id        = var.scw_project_id
  registry_endpoint = module.registry.endpoint
  database_url      = module.database.connection_string
  jwt_secret_key    = var.jwt_secret_key
  s3_bucket_name    = module.frontend.media_bucket_name
  app_domain        = var.app_domain
}

module "frontend" {
  source     = "./modules/frontend"
  project_id = var.scw_project_id
}

output "api_endpoint" {
  value = module.containers.endpoint
}

output "frontend_url" {
  value = module.frontend.website_url
}

output "database_host" {
  value     = module.database.host
  sensitive = true
}
