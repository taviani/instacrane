variable "project_id" {
  type = string
}

resource "scaleway_object_bucket" "frontend" {
  name       = "instacrane-frontend"
  project_id = var.project_id
  acl        = "public-read"

  versioning {
    enabled = false
  }
}

resource "scaleway_object_bucket_website_configuration" "frontend" {
  bucket = scaleway_object_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "scaleway_object_bucket" "media" {
  name       = "instacrane-media"
  project_id = var.project_id
  acl        = "public-read"

  versioning {
    enabled = false
  }
}

output "website_url" {
  value = scaleway_object_bucket_website_configuration.frontend.website_endpoint
}

output "media_bucket_name" {
  value = scaleway_object_bucket.media.name
}
