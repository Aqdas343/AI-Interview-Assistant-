FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose the API port
EXPOSE 5000

# Start the Node.js server
CMD ["npm", "start"]
