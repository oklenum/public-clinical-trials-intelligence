terraform {
  backend "azurerm" {
    resource_group_name  = "rg-olbi-tfstates"
    storage_account_name = "stolbitfstate"
    container_name       = "tfstate"
    key                  = "pcti-mcp.tfstate"
  }
}
