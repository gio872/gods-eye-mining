# GEM Security Architecture

## Classification

GEM is proprietary strategic R&D. Source code, model logic, target-generation logic, feature engineering, private datasets, credentials, customer data and unpublished research are confidential.

## Rules

- Never commit credentials, tokens, service-account keys, Earth Engine private keys, OAuth refresh tokens or private dataset URLs containing secrets.
- Public-source attribution is allowed; proprietary datasets and derived private features must remain outside the public repository.
- Production secrets must be injected at runtime through a secret manager.
- Client bundles must never contain privileged provider credentials.
- Model weights and proprietary training data belong in private object storage/model registries.
- Every production target run must have a run ID, model version, feature version and provenance record.
- Security incidents must not be discussed in public issues.

## Architecture

Public/client layer:
- visualization
- non-sensitive source metadata
- signed, scoped API requests

Private service layer:
- data acquisition
- Earth Engine service credentials
- proprietary feature generation
- model inference
- model registry
- project data

Private storage:
- object storage
- spatial database
- model artifacts
- audit logs

## Threat model

Primary threats:
1. source-code cloning
2. credential leakage
3. reverse engineering of targeting logic
4. unauthorized project-data access
5. prompt/data exfiltration
6. dependency compromise
7. malicious model/data poisoning
8. insider access

## Mandatory controls

- least privilege
- tenant isolation
- encryption at rest/in transit
- signed artifacts
- dependency scanning
- secret scanning
- immutable audit logs
- authenticated APIs
- rate limiting
- provenance
- model versioning
- geographic blind validation

## Important limitation

Repository visibility is controlled at the GitHub repository level. The current repository is public and the connected GitHub tooling available to this session does not expose the repository-visibility administration endpoint. Therefore no claim is made that this repository is private until GitHub itself confirms it.
