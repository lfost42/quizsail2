import re
import os
import glob

def is_question_line(line):
    """Check if a line starts with a 1 or 2-digit whole number followed by a period and a space."""
    return re.match(r'^\b\d{1,2}\.\s.*', line.strip()) is not None

def is_choice_line(line):
    """Check if a line starts with a single capital letter followed by a period and a space."""
    return re.match(r'^[A-Z]\.\s.*', line.strip()) is not None

def is_blank_line(line):
    """Check if a line is blank (empty or contains only whitespace)."""
    return not line.strip()

def is_chapter_or_decimal_line(line):
    """Check if a line starts with 'Chapter ' or a decimal number ≤ 9.9 followed by a space."""
    # Match lines starting with "Chapter "
    if re.match(r'^Chapter\s', line.strip()):
        return True
    
    # Match lines starting with a decimal number ≤ 9.9 followed by a space
    decimal_match = re.match(r'^(\d)\.(\d)\s', line.strip())
    if decimal_match:
        whole_number = int(decimal_match.group(1))  # Whole number part (0–9)
        decimal_number = int(decimal_match.group(2))  # Decimal part (0–9)
        # Check if the entire number is ≤ 9.9
        if whole_number <= 9 and decimal_number <= 9:
            return True
    
    return False

def format_text(text):
    """Format the entire text based on the specified rules."""
    lines = text.splitlines()
    formatted_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i].replace('\n', '').replace('\r', '').strip()
        
        # Skip lines that start with "Chapter " or a decimal number ≤ 9.9 followed by a space
        if is_chapter_or_decimal_line(line):
            i += 1
            continue
        
        if is_question_line(line):
            # Start of a question line
            question = line
            i += 1
            # Continue adding lines to the question until a choice line is found
            while i < len(lines) and not is_choice_line(lines[i]):
                question += " " + lines[i].replace('\n', '').replace('\r', '').strip()
                i += 1
            # Add a line break before the question line
            formatted_lines.append('\n' + question)
        elif is_choice_line(line):
            # Handle choice lines
            # Remove the period after the capital letter
            choice = re.sub(r'^([A-Z])\.\s', r'\1 ', line)
            i += 1
            # Continue concatenating lines until a numbered line, chapter line, decimal line, or another choice line is encountered
            while i < len(lines):
                next_line = lines[i].replace('\n', '').replace('\r', '').strip()
                # Stop concatenating if the next line is a numbered line, chapter line, decimal line, or another choice line
                if is_question_line(next_line) or is_chapter_or_decimal_line(next_line) or is_choice_line(next_line):
                    break
                # Skip blank lines
                if is_blank_line(next_line):
                    i += 1
                    continue
                # Append the next line to the current choice
                choice += " " + next_line
                i += 1
            formatted_lines.append(choice)
        else:
            # Skip all other lines
            i += 1
    
    return '\n'.join(formatted_lines)

def process_files():
    """Process all input files and save the formatted text to output files."""
    current_directory = os.path.dirname(os.path.abspath(__file__))
    input_files = glob.glob(os.path.join(current_directory, '*_rawq.txt'))
    
    for input_file in input_files:
        output_file = input_file.replace('_rawq.txt', '_q.txt')
        
        try:
            with open(input_file, 'r') as file:
                text = file.read()
            
            formatted_text = format_text(text)
            
            with open(output_file, 'w') as file:
                file.write(formatted_text)
            print(f"Formatted text has been saved as '{os.path.basename(output_file)}'.")
        except Exception as e:
            print(f"Error processing file {input_file}: {e}")

if __name__ == "__main__":
    process_files()