#!/usr/bin/env bash
set -euo pipefail

service_name="${1:?usage: railway-service-status.sh SERVICE_NAME}"
project_id="${RAILWAY_PROJECT_ID:?RAILWAY_PROJECT_ID is required}"
api_token="${RAILWAY_API_TOKEN:?RAILWAY_API_TOKEN is required}"

payload=$(jq -n --arg project_id "$project_id" '{
  query: "query($projectId: String!) { project(id: $projectId) { environments { edges { node { name serviceInstances { edges { node { serviceName latestDeployment { status } } } } } } } } }",
  variables: {projectId: $project_id}
}')

response=$(curl --silent --show-error --fail-with-body --max-time 15 \
  https://backboard.railway.com/graphql/v2 \
  --header "Authorization: Bearer $api_token" \
  --header 'Content-Type: application/json' \
  --data-binary "$payload")

if jq -e '.errors and (.errors | length > 0)' >/dev/null <<<"$response"; then
  echo "Railway status query failed." >&2
  exit 1
fi

jq -r --arg service "$service_name" '
  [
    .data.project.environments.edges[].node
    | select(.name == "production")
    | .serviceInstances.edges[].node
    | select(.serviceName == $service)
    | .latestDeployment.status
  ][0] // "UNKNOWN"
' <<<"$response"
