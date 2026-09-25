output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "VPC ID"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "PostgreSQL database connection endpoint"
}

output "kafka_bootstrap_brokers_tls" {
  value       = aws_msk_cluster.kafka.bootstrap_brokers_tls
  description = "Amazon MSK TLS connection string for Kafka producers and consumers"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.cluster.name
  description = "Name of the ECS Fargate cluster"
}
