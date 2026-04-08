variable "project_id" {
  type = string
}

resource "scaleway_registry_namespace" "main" {
  name        = "instacrane"
  description = "Instacrane container images"
  is_public   = false
  project_id  = var.project_id
}

output "endpoint" {
  value = scaleway_registry_namespace.main.endpoint
}

output "namespace_id" {
  value = scaleway_registry_namespace.main.id
}
