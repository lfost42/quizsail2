# to use script, add json files to this folder and run ```python3 explanation_adder.py```
# this is for json files that do not have the "e" item in each question array

import json
import os

# Get the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Iterate through all files in the script's directory
for filename in os.listdir(script_dir):
    # Check if the file is a JSON file
    if filename.endswith(".json"):
        file_path = os.path.join(script_dir, filename)
        
        # Load the JSON data from the file
        with open(file_path, "r") as file:
            data = json.load(file)
        
        # Iterate through each question and add "e" if it doesn't exist
        for item in data:
            if "e" not in item:
                item["e"] = "Explanation"
        
        # Create a new filename by appending "_updated" before the .json extension
        new_filename = filename.replace(".json", "_u.json")
        new_file_path = os.path.join(script_dir, new_filename)
        
        # Save the updated JSON to the new file
        with open(new_file_path, "w") as file:
            json.dump(data, file, indent=2)
        
        print(f"Created updated file: {new_filename}")

print("All JSON files in the script's folder have been processed.")