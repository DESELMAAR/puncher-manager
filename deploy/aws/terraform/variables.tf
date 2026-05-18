variable "aws_region" {
  description = "AWS region (e.g. eu-west-1, us-east-1)"
  type        = string
  default     = "eu-west-1"
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "puncher-manager"
}

variable "dockerhub_username" {
  description = "Docker Hub namespace (images: <user>/puncher-manager-backend)"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "db_name" {
  type    = string
  default = "puncher_db"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  description = "RDS master password (min 8 chars)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (long random string)"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "fargate_cpu" {
  type    = number
  default = 512
}

variable "fargate_memory" {
  type    = number
  default = 1024
}
