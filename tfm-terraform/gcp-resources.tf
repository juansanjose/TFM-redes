resource "google_artifact_registry_repository" "tfm" {
  location      = var.region
  repository_id = var.artifact_repo_id
  description   = "Repo for tfm images"
  format        = "DOCKER"
}

output "artifact_registry_repository" {
  description = "Artifact Registry repo path"
  value       = google_artifact_registry_repository.tfm.repository_id
}
  