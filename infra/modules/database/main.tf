variable "project_id" {
  type = string
}

variable "database_password" {
  type      = string
  sensitive = true
}

resource "scaleway_rdb_instance" "main" {
  name           = "instacrane-db"
  node_type      = "DB-DEV-S"
  engine         = "PostgreSQL-16"
  is_ha_cluster  = false
  disable_backup = false
  backup_schedule_frequency = 24
  backup_schedule_retention = 7
  volume_type    = "lssd"
  volume_size_in_gb = 10
  project_id     = var.project_id
}

resource "scaleway_rdb_database" "instacrane" {
  instance_id = scaleway_rdb_instance.main.id
  name        = "instacrane"
}

resource "scaleway_rdb_user" "app" {
  instance_id = scaleway_rdb_instance.main.id
  name        = "instacrane"
  password    = var.database_password
  is_admin    = false
}

resource "scaleway_rdb_privilege" "app" {
  instance_id   = scaleway_rdb_instance.main.id
  user_name     = scaleway_rdb_user.app.name
  database_name = scaleway_rdb_database.instacrane.name
  permission    = "all"
}

output "connection_string" {
  value     = "postgresql+asyncpg://${scaleway_rdb_user.app.name}:${var.database_password}@${scaleway_rdb_instance.main.endpoint_ip}:${scaleway_rdb_instance.main.endpoint_port}/${scaleway_rdb_database.instacrane.name}"
  sensitive = true
}

output "host" {
  value     = "${scaleway_rdb_instance.main.endpoint_ip}:${scaleway_rdb_instance.main.endpoint_port}"
  sensitive = true
}
