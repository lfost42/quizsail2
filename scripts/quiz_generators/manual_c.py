import re
import os
import sys

def process_file(input_filename):
    # Generate the output filename by replacing '_m' with '_rawm'
    filename, ext = os.path.splitext(input_filename)
    if filename.endswith('_m.txt'):
        output_filename = filename[:-len('_m.txt')] + '_rawm.txt' + ext
    else:
        output_filename = filename + '_rawm.txt' + ext

    # Regular expression to match lines starting with a number followed by a period and space
    numbered_pattern = re.compile(r'^\d+\. ')
    processing = False  # Flag to track if we are processing lines after a numbered line
    current_letter = 'A'  # Track the current capital letter to prepend

    with open(input_filename, 'r') as infile, open(output_filename, 'w') as outfile:
        for line in infile:
            line = line.rstrip('\n')  # Remove the newline character to handle line endings properly
            if processing:
                # Check if the line (after leading whitespace) starts with a '-'
                stripped_line = line.lstrip()
                if stripped_line.startswith('-'):
                    outfile.write(line + '\n')
                    processing = False
                    current_letter = 'A'
                else:
                    # Prepend the current letter and write the modified line
                    modified_line = f"{current_letter}. {line}"
                    outfile.write(modified_line + '\n')
                    # Move to the next letter, incrementing ASCII value and converting back to char
                    current_letter = chr(ord(current_letter) + 1)
            else:
                # Check if the current line is a numbered line
                if numbered_pattern.match(line):
                    outfile.write(line + '\n')
                    processing = True
                    current_letter = 'A'  # Reset to 'A' for a new group
                else:
                    outfile.write(line + '\n')

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <input_file_m>")
        sys.exit(1)
    input_filename = sys.argv[1]
    if not os.path.isfile(input_filename):
        print(f"Error: File '{input_filename}' not found.")
        sys.exit(1)
    process_file(input_filename)