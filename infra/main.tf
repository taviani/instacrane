terraform {
  required_version = ">= 1.9"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.74"
    }
  }

  backend "s3" {
    key                         = "terraform.tfstate"
    region                      = "fr-par"
    use_path_style              = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}

provider "scaleway" {
  region = "fr-par"
}

variable "bucket_name" {
  type        = string
  description = "Nom du bucket, fourni hors du dépôt."
}

variable "bucket_read_origins" {
  type        = list(string)
  description = "Origines du site autorisées à lire un objet, fournies hors du dépôt."
}

resource "scaleway_object_bucket" "media" {
  name   = var.bucket_name
  region = "fr-par"

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = var.bucket_read_origins
  }
}

resource "scaleway_object_bucket_acl" "media" {
  bucket = scaleway_object_bucket.media.name
  region = scaleway_object_bucket.media.region
  acl    = "private"
}
