#!/usr/bin/env python3
from pandocfilters import toJSONFilter, RawBlock, stringify
import sys

def latex(s):
    return RawBlock('latex', s)

def do_filter(key, value, f, m):
    if key == "Header":
        heading_no = value[0]
        if heading_no == 6:
            begin_heading = latex('\\textbf{\large \section*{')
            begin_toc = latex('\\addcontentsline{toc}{section}{')
        elif heading_no == 4:
            begin_heading = latex('\\textbf{\Large \part*{')
            begin_toc = latex('\\addcontentsline{toc}{part}{')
        else:
            return
        end_heading =  latex('}}')
        end_toc = latex('}')

        raw_content = stringify(value[2])
        content = latex(raw_content)
        contents_arr = [begin_heading, content, end_heading, begin_toc, content, end_toc]
        return contents_arr

def check_python3():
    if sys.version_info[0] < 3:
        raise Exception("Python 3 or a more recent version is required.")

if __name__ == "__main__":
    check_python3()
    toJSONFilter(do_filter)
