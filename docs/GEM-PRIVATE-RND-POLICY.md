# GEM Private R&D Policy

The repository is not the place for the complete GEM moat.

Keep these outside public source control:
- proprietary target features
- private labels
- customer/project datasets
- model weights
- calibrated production models
- private geological interpretations
- commercial data
- provider credentials
- unreleased algorithms whose disclosure would materially reduce competitive advantage

The public application should become a thin intelligence client. Sensitive computation should move server-side.

## Development rule

A feature is considered ready for public source only when its disclosure does not reveal:
- proprietary scoring formulas
- private data
- credentials
- customer information
- unpublished exploration targets
- security controls that would aid bypass

Until then, implement behind a private service boundary.
