terraform {
  required_version = ">= 1.9"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.74"
    }
  }
}

provider "scaleway" {
  region = "fr-par"
}

variable "bucket_name" {
  type        = string
  description = "Nom du bucket, fourni dans un fichier local ignoré par git."
}

resource "scaleway_object_bucket" "media" {
  name   = var.bucket_name
  region = "fr-par"
}

resource "scaleway_object_bucket_acl" "media" {
  bucket = scaleway_object_bucket.media.name
  region = scaleway_object_bucket.media.region
  acl    = "private"
}
