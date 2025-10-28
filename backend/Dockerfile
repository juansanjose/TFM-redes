# # Stage 1: Build the Quarkus application using Maven
# FROM maven:3.9-eclipse-temurin-21 AS build
# WORKDIR /workspace/app

# # Copy and resolve project dependencies first (improves cache)
# COPY pom.xml .
# RUN mvn -q -DskipTests dependency:go-offline

# # Now copy module sources and build the backend module
# COPY src ./src
# WORKDIR /workspace/app
# RUN mvn -q -DskipTests package

# # Stage 2: Create the final, smaller runtime image
# # This stage uses a JRE image and includes the Containerlab installation.
# FROM eclipse-temurin:21-jre
# WORKDIR /app

# # Copy the built JAR from the 'build' stage
# COPY --from=build /workspace/app/target/*-runner.jar /app/quarkus-runner.jar

# EXPOSE 8080

# # --- Install Containerlab (requires root privileges) ---
# # Install necessary tools (curl, bash) using apt-get for Debian-based JRE image
# RUN apt-get update && \
#     apt-get install -y curl bash && \
#     # Clean up APT cache to keep the final image size small
#     rm -rf /var/lib/apt/lists/*
    
# # Run the Containerlab installation script
# RUN curl -sL https://get.containerlab.dev | bash
# # --- End Containerlab Install ---

# # Run the Quarkus application
# ENTRYPOINT ["java","-jar","/app/quarkus-runner.jar"]
# === Build stage ===
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
# produces target/quarkus-app/ (fast-jar layout)
RUN mvn -q -DskipTests package

# === Runtime stage ===
FROM eclipse-temurin:21-jre
WORKDIR /app
# Need an SSH client for connectivity checks against containerlab nodes
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssh-client && \
    rm -rf /var/lib/apt/lists/*
# copy the fast-jar structure
COPY --from=build /app/target/quarkus-app/ /app/
EXPOSE 8080
# run the fast-jar
ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
