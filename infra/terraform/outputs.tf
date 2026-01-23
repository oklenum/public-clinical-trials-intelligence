output "resource_group" {
  value = azurerm_resource_group.rg.name
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "container_app_url" {
  value = azurerm_container_app.app.latest_revision_fqdn
}

output "container_app_principal_id" {
  value = azurerm_container_app.app.identity[0].principal_id
}
