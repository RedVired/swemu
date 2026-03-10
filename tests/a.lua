counter = 0

print("hello world")

function onTick()
  counter = counter + 1
  -- пишем число в канал 1
  output.setNumber(1, counter)
  -- флаг в bool 1
  output.setBool(2, true)
end