FROM node:20-alpine AS theme-build

WORKDIR /workspace/keycloak-theme

RUN apk add --no-cache openjdk17-jdk maven unzip

COPY keycloak-theme/package.json keycloak-theme/package-lock.json ./

RUN npm ci

COPY keycloak-theme/. .

RUN npm run build

RUN mkdir -p build_keycloak/extracted && unzip build_keycloak/keycloakify-tfm-theme-*.jar -d build_keycloak/extracted

FROM quay.io/keycloak/keycloak:26.0.2

USER root

COPY --from=theme-build /workspace/keycloak-theme/build_keycloak/extracted/theme/tfm-theme /opt/keycloak/themes/tfm-theme

USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]

CMD ["start-dev", "--import-realm"]
