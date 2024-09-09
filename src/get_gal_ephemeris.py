import requests
import os

url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle"

response = requests.get(url)
with open('../galileo_tle.txt', 'w') as file:
    file.write(response.text)
    print("File saved successfully.")