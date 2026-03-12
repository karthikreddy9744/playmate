# Use Maven image to build the application
FROM maven:3.9.11-eclipse-temurin-21 AS build
# Set the working directory in the container
WORKDIR /app
# Copy the pom.xml and download the dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B
# Copy the source code and build the application
COPY src ./src
# Build the application
RUN mvn clean package -DskipTests
# Use OpenJDK image to run the application
FROM eclipse-temurin:21-jre
# Set the working directory in the container
WORKDIR /app
# Copy the built jar file from the build stage
COPY --from=build /app/target/*.jar app.jar
# Expose the application port
EXPOSE 8080
# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
