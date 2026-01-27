variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "swedencentral"
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
  default     = "rg-olbi-mcp-servers"
}

variable "acr_name" {
  description = "Azure Container Registry name (3-50 lowercase alphanumerics)"
  type        = string
  default     = "acrolbiregistry"
}

variable "container_app_name" {
  description = "Azure Container App name"
  type        = string
  default     = "pcti-mcp"
}

variable "image_tag" {
  description = "Container image tag"
  type        = string
  default     = "1.0.1"
}

variable "cpu" {
  description = "Container CPU cores"
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Container memory (GiB)"
  type        = number
  default     = 1.0
}

variable "min_replicas" {
  description = "Minimum replicas"
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum replicas"
  type        = number
  default     = 3
}

variable "container_port" {
  description = "Application port"
  type        = number
  default     = 3333
}

variable "ingress_external" {
  description = "Expose ingress externally"
  type        = bool
  default     = true
}
