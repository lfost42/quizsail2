import re
from pathlib import Path
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
    if re.match(r'^Chapter\s', line.strip()):
        return True
    
    decimal_match = re.match(r'^(\d)\.(\d)\s', line.strip())
    if decimal_match:
        whole_number = int(decimal_match.group(1))
        decimal_number = int(decimal_match.group(2))
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
        
        if is_chapter_or_decimal_line(line):
            i += 1
            continue
        
        if is_question_line(line):
            question = line
            i += 1
            while i < len(lines) and not is_choice_line(lines[i]):
                question += " " + lines[i].replace('\n', '').replace('\r', '').strip()
                i += 1
            formatted_lines.append('\n' + question)
        elif is_choice_line(line):
            choice = re.sub(r'^([A-Z])\.\s', r'\1 ', line)
            i += 1
            while i < len(lines):
                next_line = lines[i].replace('\n', '').replace('\r', '').strip()
                if is_question_line(next_line) or is_chapter_or_decimal_line(next_line) or is_choice_line(next_line):
                    break
                if is_blank_line(next_line):
                    i += 1
                    continue
                choice += " " + next_line
                i += 1
            formatted_lines.append(choice)
        else:
            i += 1
    
    return '\n'.join(formatted_lines)

def process_files():
    """Process all input files and save the formatted text to output files."""
    current_directory = Path(__file__).parent
    input_files = list(current_directory.glob('*_rawq.txt'))
    
    output_dir = current_directory / "OutputFiles"
    output_dir.mkdir(exist_ok=True)
    
    for input_file in input_files:
        output_filename = input_file.name.replace('_rawq.txt', '_q.txt')
        output_file = output_dir / output_filename
        
        try:
            text = input_file.read_text()
            formatted_text = format_text(text)
            output_file.write_text(formatted_text)
            print(f"Formatted text has been saved as '{output_filename}'.")
        except Exception as e:
            print(f"Error processing file {input_file}: {e}")

if __name__ == "__main__":
    process_files()