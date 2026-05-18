output "app_url" {
  description = "Open this URL in the browser (HTTP)"
  value       = local.app_url
}

output "api_url" {
  description = "API base URL for the browser (same host, /api paths)"
  value       = "${local.app_url}"
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "PostgreSQL host (private — only reachable from ECS)"
  value       = aws_db_instance.postgres.address
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "frontend_rebuild_hint" {
  description = "Rebuild frontend with this API URL before users can log in"
  value       = "docker build -t ${var.dockerhub_username}/puncher-manager-frontend:aws --build-arg NEXT_PUBLIC_API_URL=${local.app_url} ./frontend && docker push ${var.dockerhub_username}/puncher-manager-frontend:aws"
}
