# Astral Projection LG — Dockerfile (optional, for Coolify's "Docker" build pack)
#
# This is a thin nginx wrapper. If you use Coolify's "Static Site" / "Static HTML"
# template instead of a Docker build pack, you don't need this — just point the
# service at ./index.html as the entry point with output directory "/".
#
# Either path produces the same running app.

FROM nginx:1.27-alpine

# Custom nginx config that ensures correct MIME types (esp. .opus) and
# disables cache for sw.js so updates propagate without a hard refresh.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets
COPY . /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
