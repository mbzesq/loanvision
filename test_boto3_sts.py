import boto3

client = boto3.client("sts")

try:
    identity = client.get_caller_identity()
    print("✅ Success:", identity)
except Exception as e:
    print("❌ Error:", str(e))

