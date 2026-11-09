# Muhammad Ashar — Technical Portfolio

[Live portfolio](https://asherahmedd.github.io/)

Personal portfolio covering solution architecture, data engineering, enterprise analytics, planning applications, and intelligent automation. The site presents selected implementation work, engineering practices, and technical articles.

## Featured work

| Project | Focus |
| --- | --- |
| [Enterprise AI-Powered Analytics Agent](projects/enterprise-ai-analytics-agent.html) | Conversational access to governed enterprise analytics and business KPIs. |
| [AI Agents for Automation](projects/ai-agents-for-automation.html) | SAP Autonomous Enterprise architecture using business data products and Joule agents. |
| [SAP Datasphere Engineering & Architecture](projects/sap-datasphere-engineering.html) | Data integration, SQL development, semantic modeling, security, and performance engineering. |
| [Enterprise Analytics & Dashboard Design](projects/advanced-sap-analytics-cloud-dashboards.html) | SAP Analytics Cloud and Power BI dashboard design across business functions. |
| [Distributor Replenishment Planning](projects/sac-distributor-replenishment-planning.html) | SAP Analytics Cloud planning application for distributor stock replenishment and approval workflows. |

## Technical writing

- [Data Access Controls for external OData applications](blog/sap-datasphere-dac-odata.html)
- [AI agents and SAP business data products](blog/sap-autonomous-enterprise-data-products-agents.html)
- [SAP ABAP development in VS Code](blog/sap-vscode-vibe-coding.html)

## Repository structure

```text
index.html                 Portfolio homepage
projects/                  Individual project presentations
blog/                      Technical articles
assets/apple-light.css     Shared visual styles
assets/analytics/          Dashboard illustrations
assets/logos/              Organization logos
assets/project-thumbnails/ Project card artwork
```

The website uses static HTML, CSS, and JavaScript and is published through GitHub Pages. The homepage includes responsive project navigation, expandable expertise and professional journey sections, and links to the individual pages.

## Local development

1. Clone the repository.
2. Serve the repository root with a local static HTTP server, for example:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000`.
4. Check desktop and mobile layouts and verify links before committing changes.

The site does not require a build step. Publish changes by committing to the branch configured for GitHub Pages.

## Content and usage

This repository contains portfolio and editorial content, not deployable versions of the enterprise systems described. Architectural visuals and sample data are illustrative; no customer credentials or confidential operational data are included. External product screenshots are credited on the relevant pages.

For professional enquiries, use the contact details on the [portfolio](https://asherahmedd.github.io/).
