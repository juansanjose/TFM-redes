terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.20"
    }
  }
}

locals {
  network_name = "${var.cluster_name}-net"
  subnet_name  = "${var.cluster_name}-subnet"
}

resource "google_compute_network" "gke" {
  name                    = local.network_name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "gke" {
  name          = local.subnet_name
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.gke.id

  secondary_ip_range {
    range_name    = "${local.subnet_name}-pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "${local.subnet_name}-services"
    ip_cidr_range = var.services_cidr
  }
}

resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  location = var.zone

  # Required even when removing the default node pool
  initial_node_count       = 1
  remove_default_node_pool = true
  networking_mode          = "VPC_NATIVE"
  network                  = google_compute_network.gke.id
  subnetwork               = google_compute_subnetwork.gke.name

  release_channel {
    channel = var.release_channel
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "${local.subnet_name}-pods"
    services_secondary_range_name = "${local.subnet_name}-services"
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.admin_source_ranges
      content {
        cidr_block   = cidr_blocks.value
        display_name = "admin-${cidr_blocks.key}"
      }
    }
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
  }
}

resource "google_container_node_pool" "primary_nodes" {
  name     = "${var.cluster_name}-pool"
  cluster  = google_container_cluster.primary.name
  location = google_container_cluster.primary.location

  node_count = var.min_node_count

  node_config {
    machine_type    = var.machine_type
    spot            = true
    disk_type       = "pd-balanced"
    disk_size_gb    = 50
    tags            = ["gke-node"]
    service_account = "default"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    metadata = {
      disable-legacy-endpoints = "true"
    }

    labels = {
      env            = "tfm"
      cost_optimized = "true"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.primary.name
}

output "gke_endpoint" {
  description = "GKE master endpoint"
  value       = google_container_cluster.primary.endpoint
}

output "gke_ca_certificate" {
  description = "Base64-encoded cluster CA certificate"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
}
