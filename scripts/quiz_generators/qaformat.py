import os
import re

def process_file(input_path, output_path):
    # print(f"\n🔍 Processing: {input_path} → {output_path}")
    
    try:
        # Initialize 'lines' first
        with open(input_path, 'r') as infile:
            lines = infile.readlines()  # Correctly initialized
        # print(f"✅ Read {len(lines)} lines from input file")
    except FileNotFoundError:
        print(f"Error: Input file {input_path} not found")
        return False
    except Exception as e:
        print(f"Error opening file: {str(e)}")
        return False

    processed = []
    error_line = None

    # State variables
    current_question = []
    current_choices = []
    seen_choices = set()
    explanation = []
    state = "start"

    for line_num, line in enumerate(lines, 1):
        raw_line = line.strip()
        if not raw_line:
            continue

        # State transitions
        if state == "start":
            if re.match(r'^\d+\. ', raw_line):
                current_question.append(raw_line)
                state = "question"
            else:
                error_line = line_num
                break

        elif state == "question":
            if re.match(r'^([A-Z])\.', raw_line):
                processed.append(' '.join(current_question))
                current_question = []
                state = "choices"
                seen_choices = {raw_line[0]}
                current_choices = [f"{raw_line[0]} {raw_line[3:]}".strip()]
            else:
                current_question.append(raw_line)

        elif state == "choices":
            if re.match(r'^\d+\. ', raw_line):
                error_line = line_num
                break
            elif re.match(r'^([A-Z])\.', raw_line):
                letter = raw_line[0]
                if letter in seen_choices:
                    processed.extend(current_choices)
                    processed.append(f"-{letter}")
                    explanation = []
                    state = "explanation"
                else:
                    seen_choices.add(letter)
                    current_choices.append(f"{letter} {raw_line[3:]}".strip())
            else:
                if current_choices:
                    current_choices[-1] += " " + raw_line

        elif state == "explanation":
            if re.match(r'^\d+\. ', raw_line):
                if explanation:
                    processed.append("--" + ' '.join(explanation))
                current_question = [raw_line]
                state = "question"
            else:
                explanation.append(raw_line)

    # Final cleanup
    if not error_line and state == "explanation" and explanation:
        processed.append("-- " + ' '.join(explanation))

    try:
        with open(output_path, 'w') as outfile:
            outfile.write('\n'.join(processed))
        return True
    except Exception as e:
        print(f"Error writing output: {str(e)}")
        return False

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # print(f"📂 Script directory: {script_dir}")
    
    for filename in os.listdir(script_dir):
        if filename.endswith("_raw.txt"):
            input_path = os.path.join(script_dir, filename)
            output_path = os.path.join(script_dir, filename.replace("_raw.txt", "_format.txt"))
            # print(f"\n🔨 Processing {filename}")
            success = process_file(input_path, output_path)
            print(f"Formatted text has been saved as '{os.path.basename(output_path)}'.")