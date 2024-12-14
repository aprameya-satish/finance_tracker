import plaid
import csv

# Set up Plaid API credentials
PLAID_CLIENT_ID = '662d1f971e2a68001c7dde46'
PLAID_SECRET = 'your_secret'
PLAID_PUBLIC_KEY = 'your_public_key'
PLAID_ENV = 'development'  # Change this to 'development' or 'production' as needed

# Initialize Plaid client
client = plaid.Client(client_id=PLAID_CLIENT_ID,
                      secret=PLAID_SECRET,
                      public_key=PLAID_PUBLIC_KEY,
                      environment=PLAID_ENV)

# Your bank credentials for testing (use actual credentials for real use)
ACCESS_TOKEN = 'your_access_token'  # Generated after successful Plaid Link authentication

# Fetch transaction data
response = client.Transactions.get(ACCESS_TOKEN, start_date='2024-01-01', end_date='2024-04-27')

# Parse and save transaction data to a CSV file
transactions = response['transactions']
fields = ['date', 'name', 'amount', 'category']  # Customize as needed
filename = 'transaction_log.csv'

with open(filename, mode='w', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=fields)
    writer.writeheader()
    for transaction in transactions:
        writer.writerow({
            'date': transaction['date'],
            'name': transaction['name'],
            'amount': transaction['amount'],
            'category': ', '.join(transaction['category']) if 'category' in transaction else ''
        })

print("Transaction log downloaded and saved to", filename)
