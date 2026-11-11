from django import template
from scores.i18n import tr

register = template.Library()
register.simple_tag(tr, name="tr")
