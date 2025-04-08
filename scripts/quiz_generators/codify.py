#!/usr/bin/env python3

import sys

def text_converter():
    print("""\
Enter your text. Lines will be preserved exactly as entered.
Type ':end' on a separate line to finish.
==============================================""")
    
    buffer = []
    try:
        while True:
            line = input()
            if line.strip().lower() == ":end":
                break
            buffer.append(line)
    except (EOFError, KeyboardInterrupt):
        print("\nInput closed.")
    
    # Preserve original formatting with explicit \n replacement
    raw_content = '\n'.join(buffer)
    converted = raw_content.replace('\n', r'\n')
    
    print("\nOutput (with dashes preserved):")
    print(f"<code>\\n{converted}</code>")

if __name__ == "__main__":
    text_converter()