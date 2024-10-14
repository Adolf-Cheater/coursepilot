# Use the official Node.js image as the base image
FROM node:16 as node-build

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy your Node.js application files
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to start the Node.js server
CMD ["node", "server.js"]

# Stage for Python (used for running Python scripts, not a server)
FROM python:3.9-slim as python-build

# Set the working directory
WORKDIR /usr/src/app

# Copy Python dependencies and install them
COPY requirements.txt ./
RUN pip install -r requirements.txt

# No need to expose a port, only using Python for scripts
