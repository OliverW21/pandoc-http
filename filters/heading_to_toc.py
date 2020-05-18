#!/usr/bin/env python3
from pandocfilters import toJSONFilter, RawBlock, RawInline, stringify, Para
import sys
import json

def latex(s):
    return RawBlock('latex', s)

def inlatex(s):
    return RawInline('latex', s)

def do_filter(key, value, f, m):
    if key == "Header":
        heading_no = value[0]
        if heading_no == 6:
            begin_heading = latex(r'\\textbf{\large \section*{')
            begin_toc = latex(r'\\addcontentsline{toc}{section}{')
        elif heading_no == 4:
            begin_heading = latex(r'\\textbf{\Large \part*{')
            begin_toc = latex(r'\\addcontentsline{toc}{part}{')
        else:
            return
        end_heading =  latex(r'}}')
        end_toc = latex(r'}')

        raw_content = stringify(value[2])
        log(raw_content)
        content = latex(raw_content)
        contents_arr = [begin_heading, content, end_heading, begin_toc, content, end_toc]
        return contents_arr


def log(obj):
    json_content = json.dumps(obj)
    f = open("sample.json", "w")
    f.write(json_content)
    f.close()


if __name__ == "__main__":
    if sys.version_info[0] < 3:
        raise Exception("Python 3 or a more recent version is required.")
    toJSONFilter(do_filter)
