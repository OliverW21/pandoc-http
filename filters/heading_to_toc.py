#!/usr/bin/env python3
from pandocfilters import toJSONFilter, RawBlock, stringify, Para
import sys

def latex(s):
    return RawBlock('latex', s)

def do_filter(key, value, f, m):
    if key == "Header":
        heading_no = value[0]
        if heading_no == 6:
            begin_heading = '\\textbf{\large \section*{'
            begin_toc = '\\addcontentsline{toc}{section}{\\normalfont'
        elif heading_no == 4:
            begin_heading = '\\textbf{\Large \part*{'
            begin_toc = '\\addcontentsline{toc}{part}{'
        else:
            return
        end_heading =  '}}\n'
        end_toc = '}'

        raw_content = stringify(value[2])

        heading = begin_heading + raw_content + end_heading
        toc = begin_toc + raw_content + end_toc
        return latex(heading + toc)

def check_python3():
    if sys.version_info[0] < 3:
        raise Exception("Python 3 or a more recent version is required.")

if __name__ == "__main__":
    check_python3()
    toJSONFilter(do_filter)
