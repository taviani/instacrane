terraform {
  required_version = ">= 1.9"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.40"
    }
  }
}

provider "scaleway" {
  zone   = "fr-par-1"
  region = "fr-par"
}

variable "scw_project_id" {
  type = string
}

resource "scaleway_object_bucket" "tfstate" {
  name       = "instacrane-tfstate"
  project_id = var.scw_project_id

  versioning {
    enabled = true
  }
}

output "tfstate_bucket" {
  value = scaleway_object_bucket.tfstate.name
}
