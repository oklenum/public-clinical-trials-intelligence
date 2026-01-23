# Core resources for MCP server on Azure Container Apps

locals {
  image_name = "public-clinical-trials-intelligence"
  image_full = "${azurerm_container_registry.acr.login_server}/${local.image_name}:${var.image_tag}"
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Standard"
  admin_enabled       = false
}

resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-${var.container_app_name}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_user_assigned_identity" "acr_pull" {
  name                = "uai-${var.container_app_name}-acr-pull"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.acr_pull.principal_id
}

resource "azurerm_container_app_environment" "env" {
  name                       = "cae-${var.container_app_name}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.law.id
}

resource "azurerm_container_app" "app" {
  name                         = var.container_app_name
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.acr_pull.id]
  }

  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.acr_pull.id
  }

  depends_on = [azurerm_role_assignment.acr_pull]

  ingress {
    external_enabled = var.ingress_external
    target_port      = var.container_port
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = var.container_app_name
      image  = local.image_full
      cpu    = var.cpu
      memory = "${var.memory}Gi"

      env {
        name  = "MCP_TRANSPORT"
        value = "streamable-http"
      }
      env {
        name  = "MCP_HTTP_PORT"
        value = tostring(var.container_port)
      }
      env {
        name  = "MCP_HTTP_HOST"
        value = "0.0.0.0"
      }
    }
  }
}


