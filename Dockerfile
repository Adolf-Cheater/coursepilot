# Use the official Node.js image as the base image
FROM node:16 as build

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the entire application (Node.js + Python scripts)
COPY . .

# Install Python and necessary Python dependencies
RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install -r requirements.txt

# Expose the port the Node.js app runs on
EXPOSE 8000

# Command to start the Node.js server
CMD ["node", "server.js"]
