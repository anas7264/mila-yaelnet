# Recovery and Deployment Blocker

Production project: mila-yaelnet-vocabulary
Production deployment: dpl_3gx8WGNYSCqfBtu4hqpnMiaj6Ba7
Deployment URL: https://mila-yaelnet-vocabulary-5vmrmkmvj-anasagbareea-7788s-projects.vercel.app
Production alias: https://mila-yaelnet-vocabulary.vercel.app
Vercel framework metadata: Flask
Build runtime: Python 3.12
Recovered requirements: Flask==3.1.1
Original linked Git repository and deployment commit SHA were not available.

Recovered the 18-file client bundle from the Vercel deployment payload. This P0 branch rebuilds that bundle with 21 files. SHA-256, size and member count are recorded in SOURCE_MANIFEST.json.

BLOCKER: app.py remains missing because the Vercel source API response was truncated. The /_src route redirected to the Vercel dashboard Source view. No app.py was reconstructed. Therefore no Preview or production deployment is safe yet.

No production deployment, Supabase schema, RLS, authentication or environment variables were changed.
