import re
import os

def format_file(input_file):
    # Generate the output file name
    output_file = input_file.replace("_rawa", "_a")
    
    with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
        explanation_buffer = []  # Buffer to accumulate explanation lines
        
        for line in infile:
            line = line.rstrip()  # Remove trailing whitespace
            
            # Check if the line starts with "Chapter " and assign it to a variable
            if re.match(r'^Chapter ', line):
                continue  # Skip further processing for this line
            
            # Check if the line starts with a number pattern (e.g., "1. ")
            if re.match(r'^\d{1,2}\. ', line):
                # Write any buffered explanation text before processing the number line
                if explanation_buffer:
                    _write_explanation_buffer(outfile, explanation_buffer)
                    explanation_buffer = []  # Reset the buffer
                
                # Identify the line as number_text and write the number
                number_text = line[:3]  # Extract the number and period
                outfile.write(f"\n{number_text}\n")  # Write the number line as is
                remaining_text = line[3:].strip()  # Extract explanation text after the number
                if remaining_text:
                    explanation_buffer.append(remaining_text)  # Add to the buffer
                continue  # Skip further processing for this line
            
            # Add the line to the explanation buffer
            explanation_buffer.append(line)
        
        # Write any remaining buffered explanation text at the end of the file
        if explanation_buffer:
            _write_explanation_buffer(outfile, explanation_buffer)

def _write_explanation_buffer(outfile, buffer):
    """
    Helper function to write the explanation buffer to the output file.
    Splits off and formats the answer line if present.
    """
    # Concatenate the buffer into a single string
    explanation_text = ' '.join(buffer)
    
    # Check if the explanation text starts with an answer pattern (e.g., "A, B, C, D.")
    match = re.match(r'^([A-Z][.,](?:\s[A-Z][.,])*)', explanation_text)
    if match:
        answer_line = match.group(1)  # Extract the answer sequence
        answer_line = answer_line.replace(",", "").replace(".", "")  # Remove commas and periods
        outfile.write(f"-{answer_line.strip()}\n")  # Write the cleaned answer line with a "-" prefix
        remaining_text = explanation_text[match.end():].strip()  # Extract the remaining explanation text
        if remaining_text:
            outfile.write(f"--{remaining_text}\n")  # Write the remaining explanation text with a "--" prefix
    else:
        # Write the entire explanation text as is
        outfile.write(f"{explanation_text}\n")

def process_all_rawa_files():
    # Find all files in the current directory ending with '_rawa'
    for file in os.listdir():
        if file.endswith("_rawa.txt"):  # Process only text files ending with '_rawa'
            # print(f"Processing file: {file}")
            try:
                format_file(file)
                print(f"Formatted file has been saved as {file.replace('_rawa', '_a')}")
            except Exception as e:
                print(f"Error processing {file}: {e}")

# Run the function to process all '_rawa' files
process_all_rawa_files()