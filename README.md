# next-connect
 
# Purpose
This script allows wallet or web applications to access nft sell orders and nft information with proven ownership.

# Requirements
The script has been developed for Nodejs 16.0.0 and NPM 7.1.0.
# Install Steps
```
git clone https://github.com/sakdeniz/next-connect.git
cd next-connect
npm install
```
The script stores NFT ownership, NFT sales orders and NFT Collection data in MySQL database.
You should create a MySQL database and import database.sql file.
In order to connect to the MySQL database server, you must create a file named .env in the folder where the script is located and add the following lines.
```
MYSQL_HOST="localhost"
MYSQL_USER="database_name_here"
MYSQL_PASSWORD="password_here"
```
After completing the steps required for MySQL connection, you can run the script.
```
screen node index.js
```
When you run the script, it will start listening for incoming requests for the API on port 3000.
# Request parameters
Requests should be made in accordance with the URL structure below.
http://localhost:3000/{function}

# Functions
```
GetSellOrders
```
Returns all active sell orders in JSON format.

Response
```
{
  "status": "success",
  "orders": []
}
```

```
CreateSellNftOrder
```
Creates an NFT sell order.
POST Parameters
```
{
  "order": {},
  "proof": {}
}
```
Response
```
{
  "status": "order_created",
  "message": "Order created",
  "order": {}
}
```