# resource "google_iap_brand" "tfm" {
#   # Brand is required before creating IAP clients. Only one brand is allowed per project.
#   project           = var.project_id
#   support_email     = var.iap_support_email
#   application_title = var.iap_application_title
# }

# resource "google_iap_client" "tfm" {
#   brand        = google_iap_brand.tfm.name
#   display_name = var.iap_client_display_name
# }

# output "iap_client_id" {
#   description = "OAuth2 client ID for IAP-protected backends"
#   value       = google_iap_client.tfm.client_id
# }

# output "iap_client_secret" {
#   description = "OAuth2 client secret for IAP-protected backends"
#   value       = google_iap_client.tfm.secret
#   sensitive   = true
# }
