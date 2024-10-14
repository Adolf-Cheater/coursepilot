# Use an image that includes both Node.js and Python
FROM nikolaik/python-nodejs:python3.9-nodejs16

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy Python requirements and install them
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Copy all application files
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to start the Node.js server
CMD ["node", "server.js"]
