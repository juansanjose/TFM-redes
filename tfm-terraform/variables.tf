variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
  default     = "tfm-kubernetes"
}

variable "artifact_repo_id" {
  description = "Artifact Registry repository id (name)"
  type        = string
  default     = "tfm"
}

variable "registry_prefix" {
  description = "Container registry prefix (e.g., us-central1-docker.pkg.dev/<project>/repo). Leave empty to derive from project."
  type        = string
  default     = ""
}

variable "cluster_name" {
  description = "Name for the GKE cluster"
  type        = string
  default     = "tfm-gke"
}

variable "region" {
  description = "Region for network resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "Zone for the cluster (single-zone keeps costs low)"
  type        = string
  default     = "us-central1-a"
}

variable "machine_type" {
  description = "Machine type for worker nodes"
  type        = string
  default     = "e2-small"
}

variable "subnet_cidr" {
  description = "Primary CIDR range for the GKE subnet"
  type        = string
  default     = "10.10.0.0/24"
}

variable "pods_cidr" {
  description = "Secondary CIDR for pods"
  type        = string
  default     = "10.20.0.0/18"
}

variable "services_cidr" {
  description = "Secondary CIDR for services"
  type        = string
  default     = "10.30.0.0/24"
}

variable "admin_source_ranges" {
  description = "CIDR blocks allowed to reach the Kubernetes API"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "iap_support_email" {
  description = "Support email for the IAP OAuth consent screen (must be a verified email in the project)"
  type        = string
  default     = "cardanosanjose@gmail.com"
}

variable "iap_application_title" {
  description = "Display name for the IAP OAuth consent screen"
  type        = string
  default     = "TFM Access"
}

variable "iap_client_display_name" {
  description = "Display name for the IAP OAuth2 client"
  type        = string
  default     = "tfm-iap-client"
}

variable "min_node_count" {
  description = "Minimum nodes for autoscaling (spot instances)"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum nodes for autoscaling"
  type        = number
  default     = 3
}

variable "release_channel" {
  description = "GKE release channel to use"
  type        = string
  default     = "REGULAR"
}

variable "kube_namespace" {
  description = "Namespace for app workloads"
  type        = string
  default     = "tfm"
}

variable "backend_image" {
  description = "Container image for the backend"
  type        = string
  default     = ""
}

variable "frontend_image" {
  description = "Container image for the frontend"
  type        = string
  default     = ""
}

variable "keycloak_image" {
  description = "Container image for keycloak (custom theme)"
  type        = string
  default     = ""
}

variable "guacd_image" {
  description = "Container image for guacd"
  type        = string
  default     = ""
}

variable "guacamole_image" {
  description = "Container image for guacamole web"
  type        = string
  default     = ""
}

variable "postgres_image" {
  description = "Container image for postgres"
  type        = string
  default     = ""
}

variable "sshd_image" {
  description = "Container image for sshd test server"
  type        = string
  default     = ""
}

variable "postgres_user" {
  description = "Postgres username"
  type        = string
  default     = "guacamole"
}

variable "postgres_password" {
  description = "Postgres password"
  type        = string
  default     = "guacpass"
}

variable "postgres_database" {
  description = "Postgres database name"
  type        = string
  default     = "guacamole"
}

variable "keycloak_admin_user" {
  description = "Keycloak bootstrap admin user"
  type        = string
  default     = "admin"
}

variable "keycloak_admin_password" {
  description = "Keycloak bootstrap admin password"
  type        = string
  default     = "admin"
}

variable "keycloak_realm" {
  description = "Keycloak realm name"
  type        = string
  default     = "tfm"
}

variable "keycloak_client_id" {
  description = "Keycloak client id for backend"
  type        = string
  default     = "tfm-backend"
}

variable "keycloak_token_issuer" {
  description = "Issuer URL expected by backend tokens"
  type        = string
  default     = "http://localhost:8082/realms/tfm"
}

variable "ssh_user" {
  description = "SSH test user"
  type        = string
  default     = "user"
}

variable "ssh_password" {
  description = "SSH test user password"
  type        = string
  default     = "password"
}
