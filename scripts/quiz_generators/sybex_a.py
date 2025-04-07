import re
import os

# Get directory where the script resides
script_dir= os.path.dirname(os.path.abspath(__file__))
output_dir = os.path.join(script_dir, "OutputFiles")

def format_file(input_file, output_dir):
    # Generate the output file name with path
    output_filename = input_file.replace("_rawa", "_a")
    output_file = os.path.join(output_dir, output_filename)  # Full output path
    
    with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
        explanation_buffer = []  # Buffer to accumulate explanation lines
        
        for line in infile:
            line = line.rstrip()  # Remove trailing whitespace
            
            if re.match(r'^Chapter ', line):
                continue
            
            if re.match(r'^\d{1,2}\. ', line):
                if explanation_buffer:
                    _write_explanation_buffer(outfile, explanation_buffer)
                    explanation_buffer = []
                
                number_text = line[:3]
                outfile.write(f"\n{number_text}\n")
                remaining_text = line[3:].strip()
                if remaining_text:
                    explanation_buffer.append(remaining_text)
                continue
            
            explanation_buffer.append(line)
        
        if explanation_buffer:
            _write_explanation_buffer(outfile, explanation_buffer)

def _write_explanation_buffer(outfile, buffer):
    # (Keep this function the same as original)
    explanation_text = ' '.join(buffer)
    match = re.match(r'^([A-Z][.,](?:\s[A-Z][.,])*)', explanation_text)
    if match:
        answer_line = match.group(1)
        answer_line = answer_line.replace(",", "").replace(".", "")
        outfile.write(f"-{answer_line.strip()}\n")
        remaining_text = explanation_text[match.end():].strip()
        if remaining_text:
            outfile.write(f"--{remaining_text}\n")
    else:
        outfile.write(f"{explanation_text}\n")

def process_all_rawa_files():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "OutputFiles")
    os.makedirs(output_dir, exist_ok=True)  # This creates the directory
    
    # Process files
    for file in os.listdir():
        if file.endswith("_rawa.txt"):
            try:
                format_file(file, output_dir)  # Pass output_dir to formatter
                new_name = os.path.join(output_dir, file.replace('_rawa', '_a'))
                print(f"Formatted file saved as {new_name}")
            except Exception as e:
                print(f"Error processing {file}: {e}")

process_all_rawa_files()