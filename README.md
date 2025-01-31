# serveit

The spendit backend

## Install

In this project, run `npm install`

## Important directories

- `src` - source code
- `dist` - compiled code
- `data` - data files (storage of certificates, config files etc.)
    - `config` - configuration files
    - `certs` - ssl certificates

## Setup

### MongoDB

Provided in this project is a docker-compose file that will setup a mongodb instance with a persistent volume. To use it, run `docker compose -f docker-compose.database.yml up -d` in the project directory. This will start a mongodb instance on port 27017 with a persistent volume in the `mongodata` directory. If you are using the provided docker-compose file, you do not need to set the `DB_URL` environment variable to `127.0.0.1`.

You can also use your own mongodb instance, but you will need to set the `DB_URL`, `DB_PORT`, `DB_USER`, and `DB_PASS` environment variables to the correct values.

### Environment Variables

Before the server can be used in production, the following enivronment variables must be set:
- NODE_ENV (production/development)
- DB_URL (mongodb url)
- DB_PORT (mongodb port, only needed for localhost url)
- DB_USER (mongodb username)
- DB_PASS,
- INCLUDE_APP (true/false) [whether the backend server should serve the frontend app]
- INCLUDE_GOOGLE (true/false) [whether the backend server should use google services (gmail, google oauth, etc.)]
- BACKEND_PORT (port to run backend server on)
- BACKEND_DOMAIN (domain to run backend server on)
- SELFSIGN (true/false) [whether you need a ssl certificate for the backend server or if you are providing one yourself]
- CF_TOKEN (cloudflare api token) [if set and domain dns is managed by cloudflare, the ssl certificate will be a proper certificate using a certificate authority and not an insecure self-signed one]
- STRIPE_SECRET (stripe secret key)
- STRIPE_WEBHOOK_SECRET (stripe webhook secret key)

For example, a typical enviroment variables for production would look like:

```
NODE_ENV=production
DB_URL=127.0.0.1 #For DB hosted on same machine as server with default port and no username/password
INCLUDE_APP=true #Only needed if serving frontend app from backend server
INCLUDE_GOOGLE=true #Only needed if using/testing google services
BACKEND_PORT=3030 #Port to run backend server on
BACKEND_DOMAIN=phrydge.engphys.com #Domain to run backend server on
SELFSIGN=true #Make backend manage ssl certificate
CF_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX #Cloudflare api token for valid ssl certificate generation
STRIPE_SECRET=sk_test_XXXXXXXX
STRIPE_WEB=whsec_XXXXXXXX
```

### First Run

On the first run, the the server will produce a setup link in the console and logs that you must visit to setup the server. It will go through the following steps:

1. Create a new admin account
2. Configure email settings
   - Allows you to choose between using gmail, smtp, or mock email, or no email at all
   - If using gmail, you must have set the `INCLUDE_GOOGLE` environment variable to `true` and have a `google_credentials.json` file in the config folder. (the setup page will tell you how to get this file).
   - If using smtp, additional configuration options will be available to set the host, port, username, and password, and whether to use secure connection (tls/ssl).
3. If `INCLUDE_GOOGLE` is set to `true`, you will be asked to authorize the server for all the configured scopes. This is required for the server to use google services.
4. The last step is to configure the storefronts branding (currently not implemented)

The email and branding settings can be changed at any time in the config folder.

## Starting the server

### Production

First build project: `npm run build` then setup either a nodemon, systemctl service, or cpanel node.js application

#### Nodemon

WIP

#### Systemctl Service

The following is an example of a systemd service file for the backend server. 

```
[Unit]
Description=Phrydge Dev Node Website
After=network-online.target

[Service]
# Set working directory
WorkingDirectory=/srv/phrydge-dev/
ExecStart=/usr/bin/node /srv/phrydge-dev/backend/index.js 
Restart=always
# Set environment variables from .env file
EnvironmentFile = /srv/phrydge-dev/.env

[Install]
WantedBy=multi-user.target
```

Create the service file in `/etc/systemd/system/service-name.service` and enable it with `systemctl enable service-name.service`. Then start the service with `systemctl start service-name.service`.

#### Cpanel Node.js Application

WIP

### Development

For live compiling and reload while developing run: `npm run watch`